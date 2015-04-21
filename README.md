# grunt-bower-update v0.1.0
> Update versions of bower.json dependencies interactively

## Getting Started
This plugin requires Grunt `~0.4.0`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-bower-update --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-bower-update');
```

## Bower-update task
_Run this task with the `grunt bower-update` command._

Also note that running grunt with the `--verbose` flag will output some extra information. This can be very helpful in seeing actual console logs/errors during processing.

### Options

#### cwd
Type: `String`
Default: `process.cwd()`

Where to look for `bower.json` files

#### devDependencies
Type: `Boolean`
Default: `true`

Includes `devDependencies` to be checked for update

#### clearResolutions
Type: `Boolean`
Default: `true`

Removes updated dependency from `resolutions` section in `bower.json`

#### pickAll
Type: `Boolean`
Default: `false`

Skips interactive selection of dependencies to be checked for update
_Note, you can pass `--pick-all=true` to set up this option_

#### forceLatest
Type: `Boolean`
Default: `false`

Skips interactive selection of dependency version, choosing the most latest 
_Note, you can pass `--force-latest=true` to set up this option_

#### rangeChar
Type: `String`
Default: `(none)`

Sets default range char to saved version. Usually you want to use [`^` for minor updates](https://github.com/npm/node-semver#caret-ranges-123-025-004) or [`~` for patch updates](https://github.com/npm/node-semver#tilde-ranges-123-12-1)
_Note, you can pass `--range-char="^"` to set up this option_

#### filter
Type: `Function`
Default: `(none)`
Arguments: `(package, options)`
Returns: `true|false`

Replaces interactive selection to custom method, which should decide if dependency should be checked for update

#### choose
Type: `Function`
Default: `(none)`
Arguments: `(package, options)`
Returns: `String`

Replaces interactive selection to custom method, which decides the exact dependency target to be saved in `bower.json`

### Usage examples

```js
// Totally Non-interactive
grunt.initConfig({
  'bower-update': {
    options: {
      pickAll: true,
      forceLatest: true,
      rangeChar: '~'
    }
  }
});


// Using `filter` hook
grunt.initConfig({
  'bower-update': {
    options: {
      customPrefix: 'my-',
      filter: function (package, options) {
        if (package.name.indexOf(options.customPrefix) === 0) {
          return true;
        }
        return false;
      }
    }
  }
});
```

---

## Release History

 * 2015-04-15 **v0.1.0**
   - Initial release.
