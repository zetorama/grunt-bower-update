/* global -Promise */
// jshint node:true
var Promise = require('bluebird');
var inquirer = require('inquirer');
var semver = require('semver');
var endpointParser = require('bower-endpoint-parser');
var bowerInfo = require('bower/lib/commands/info');
var BowerLogger = require('bower-logger');
var logger = new BowerLogger();
var bowerJson = require('bower-json');

module.exports = function(grunt) {

  grunt.registerTask('bower-update', 'Update bower.json versions', function () {
    var done = this.async();
    var options = this.options({
      cwd: process.cwd(),
      devDependencies: true,
      clearResolutions: true,
      pickAll: false,
      forceLatest: false,
      rangeChar: '',
      logBowerInfo: 'warn',
      filter: void 0,
      choose: void 0
    });
    var log = function log(msg) {
      var logger = defineLogger(options.logBowerInfo, msg);
      var name = msg.data.endpoint.name || msg.data.pkgMeta.name || msg.data.endpoint.source;
      logger('%s: bower %s [%s] - %s', name.yellow, msg.level, msg.id, msg.message.grey);
    };

    if (grunt.option('force-latest')) {
      options.forceLatest = grunt.option('force-latest');
    }
    if (grunt.option('pick-all')) {
      options.pickAll = grunt.option('pick-all');
    }
    if (grunt.option('range-char')) {
      options.rangeChar = grunt.option('range-char');
    }
    if (grunt.option('log-bower-info')) {
      options.logBowerInfo = grunt.option('log-bower-info');
    }

    logger.addListener('log', log);

    readJSON(options)
      .then(prepareDeps.bind(null, options))
      .then(getInfo.bind(null, options))
      .then(chooseVersions.bind(null, options))
      .then(saveJSON.bind(null, options))
      .then(done)
      .catch(function fail(err) {
        grunt.verbose.error('\n', err);
        grunt.fail.warn(err.message);
      })
      .finally(function always() {
        logger.removeListener('log', log);
      });
  });

  function minSatisfying(versions, range) {
    return versions
      .filter(function (version) {
        return semver.satisfies(version, range);
      })
      .sort(semver.compare)[0] || null;
  }

  function depChoice(pkg) {
    return {
      name: String(pkg.name).bold + ' - ' + pkg.target,
      value: pkg,
      checked: true
    };
  }

  function versionChoices(version, rangeChar) {
    if (rangeChar) {
      return [
        {
          name: String(rangeChar + version).yellow,
          value: rangeChar + version
        }
      ];
    }

    return [
      {
        name: ' ' + version.yellow + ' - only strict version',
        value: version
      }, {
        name: String('^' + version).yellow + ' - any minor update',
        value: '^' + version
      }, {
        name: String('~' + version).yellow + ' - any patch update',
        value: '~' + version
      }
    ];
  }

  function getPackages(dependencies, isDev) {
    return Object.keys(dependencies || {}).reduce(function info(deps, name) {
      var pkg = endpointParser.json2decomposed(name, dependencies[name]);
      var target = pkg.target;
      pkg.range = semver.validRange(target);
      pkg.rangeChar = pkg.range && target !== '*' && semver.valid(target) !== target ? target.charAt(0) : '';

      pkg.dev = isDev;
      return deps.concat(pkg);
    }, []);
  }

  function prepareDeps(options, json) {
    var incDev = options.devDependencies;
    var deps = getPackages(json.dependencies);
    var devDeps = incDev ? getPackages(json.devDependencies, true) : [];

    if (typeof options.filter === 'function') {
      grunt.verbose.writeln('Selecting packages by provided `filter` function...');
      return Promise.resolve(deps.concat(devDeps).filter(function (pkg) {
        return options.filter(pkg, options);
      }));
    }

    if (options.pickAll) {
      grunt.verbose.writeln('All packages are picked to update version.');
      return Promise.resolve(deps.concat(devDeps));
    }

    var total = deps.length + (incDev && devDeps.length || 0);
    var question = 'Which packages whould you like to check?'.yellow + ' (' + total + ' in total)';
    var choices = [];
    if (deps.length) {
      choices = choices.concat(new inquirer.Separator('dependencies:'), deps.map(depChoice));
    }
    if (incDev && devDeps.length) {
      choices = choices.concat(new inquirer.Separator('devDependencies:'), devDeps.map(depChoice));
    }

    return new Promise(function promise(resolve, reject) {
      inquirer.prompt([
        {
          type: 'checkbox',
          message: question,
          name: 'deps',
          choices: choices
        }
      ], function (answers) {
        resolve(answers.deps);
      });
    });
  }

  function getInfo(options, deps) {
    grunt.log.writeln('Loading dependencies information...');
    return Promise.all(deps.map(function (pkg) {
      return bowerInfo(logger, pkg.source)
        .then(function (entry) {
          pkg.versions = entry.versions || [];
          pkg.latest = entry.latest || {};
          grunt.verbose.writeln('Got info on %s package - latest version is %s',
            pkg.name.blue, String(pkg.latest.version).white);
          return pkg;
        });
    }));
  }

  function chooseVersions(options, deps) {
    var updated = deps.filter(function (pkg) {
      var latest = pkg.latest.version;
      pkg.min = minSatisfying(pkg.versions, pkg.range);
      pkg.max = semver.maxSatisfying(pkg.versions, pkg.range);
      return latest && pkg.min !== latest;
    });

    if (typeof options.choose === 'function') {
      grunt.verbose.writeln('Selecting packages by provided `choose` function...');
      return Promise.resolve(updated.map(function (pkg) {
        pkg.value = options.choose(pkg, options);
        return pkg;
      }));
    }

    if (options.forceLatest) {
      grunt.verbose.writeln('Forced latest versions for every package.');
      return Promise.resolve(updated.map(function (pkg) {
        pkg.value = (options.rangeChar || pkg.rangeChar) + pkg.latest.version;
        grunt.log.writeln('For %s version %s has been chosen.', pkg.name.yellow, pkg.value.yellow);
        return pkg;
      }));
    }

    var questions = updated.map(function (pkg) {
      var message = 'Which target to be set for ' + pkg.name.yellow + '?';
      var latest = pkg.latest.version;
      var choices = [
        // new inquirer.Separator('Current is ' + pkg.target),
        {
          name: pkg.target.yellow + ' - keep current',
          value: pkg.target
        }
      ];

      if (pkg.min === pkg.max) {
        choices.push(new inquirer.Separator('Max satisfying version is the same.'));
      } else {
        choices.push(new inquirer.Separator('Max satisfying version is ' + pkg.max));
        choices = choices.concat(versionChoices(pkg.max, options.rangeChar));
      }

      if (pkg.max !== latest) {
        choices.push(new inquirer.Separator('Latest version is ' + latest));
        choices = choices.concat(versionChoices(latest, options.rangeChar));
      }

      return {
        type: 'list',
        message: message,
        name: pkg.name,
        choices: choices,
        default: (options.rangeChar || pkg.rangeChar) + latest
      };
    });

    return new Promise(function promise(resolve, reject) {
      inquirer.prompt(questions, function(answers) {
        resolve(updated.map(function (pkg) {
          pkg.value = answers[pkg.name];
          return pkg;
        }));
      });
    });
  }

  function readJSON(options) {
    return Promise.promisify(bowerJson.find)(options.cwd)
      .then(function (filename) {
        options.bowerFile = filename;
        grunt.verbose.writeln('Parsing %s...', filename.blue);
        return Promise.promisify(bowerJson.read)(filename);
      })
      .spread(function (json) {
        options.json = json;
        return json;
      });
  }

  function saveJSON(options, deps) {
    var json = options.json;
    var resolutions = json.resolutions || {};
    var num = 0;
    deps.forEach(function (pkg) {
      var dest = pkg.dev ? json.devDependencies : json.dependencies;
      var target = pkg.value || pkg.target;
      var endpoint = endpointParser.decomposed2json({
        name: pkg.name,
        source: pkg.source,
        target: target
      });

      dest[pkg.name] = endpoint[pkg.name];

      if (options.clearResolutions) {
        delete resolutions[pkg.name];
      }

      if (target !== pkg.target) {
        num++;
      }
    });

    grunt.file.write(options.bowerFile, JSON.stringify(json, null, '  ') + '\n');
    grunt.log.ok('Successfully updated versions of %s bower dependencies.', num);

    return json;
  }

  function defineLogger(criteria, msg) {
    var level = BowerLogger.LEVELS[msg.level];
    // use #error() if produced either warn, conflict or error
    var method = level >= 3 ? 'error' : 'writeln';
    var dest;
    if (typeof criteria === 'boolean') {
      dest = criteria ? 'log' : 'verbose';
    } else if (typeof criteria === 'function') {
      dest = criteria(msg) ? 'log' : 'verbose';
    } else {
      if (typeof criteria === 'string' && criteria in BowerLogger.LEVELS) {
        criteria = BowerLogger.LEVELS[criteria];
      }

      dest = (Number(criteria) || 0) <= level ? 'log' : 'verbose';
    }

    return grunt[dest][method].bind(grunt[dest]);
  }

};
