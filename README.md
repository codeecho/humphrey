# Humphrey

> *Let Humphrey do the grunt work for you*

Humphrey is a tool which simplifies and speeds up using Grunt. It allows you to scaffold snippets of the grunt file and add them with a single command. To maximise the resuse of these snippets Humphrey adds a bit of convention to the grunt file with a standard directory structure and lifecycle (see below).

### Install Humphrey

Install humphrey globally using npm

```sh
npm install -g humphrey
```

### The lifecycle of a Humphrey project

* setup - Tasks that need to be run to setup the project. eg installing dependencies
* validate - Tasks that validate the source code. eg. jshint
* build - Tasks that process the source files, and output the final result to the app directory. eg. processing SASS files, minifying javascript
* test - Test the build. eg. jasmine, mocha
* package - Package the contents of the app directory. eg. create a tar, war or zip file
* archive - Do something with the generated package eg. publish to an artifact repository
* deploy - Deploy the app somewhere. eg. S3, github pages

Each stage in the lifecycle is available as a grunt task and each one will run all preceding lifecycle tasks first. The default grunt task is "test", running this will run - setup, validate, build and test tasks.

### Preparing your project

Before running Humphrey you first need to setup package.json

```sh
npm init
```

### Setting up your project with Humphrey

```sh
humphrey init
```

This will setup the Gruntfile.js and put in place the following directories structure.

* src - Your source code lives here
* test - Test cases live here
* build - This is where all compilation happens
* app - This is where the built files will end up
* dist - This is where any packages would end up

build, app and dist directories should not be checked in to your version control system

You can now build your project

```sh
grunt build
```

At this stage this will simply copy the contents of the src directory to the app directory, without doing any processing.

### Installing modules with Humphrey

```sh
humphrey module:install jshint
```

This will install the jshint module, which will get applied at the validate stage in the build.

```sh
humphrey module:install htmlmin
```

Now your html will be minified. This module runs during the build stage.

```sh
humphrey module:install jade
```

This will install the jade module, to generate html from your jade files. This module also gets applied at the build stage. Because you already have the htmlmin module running during this stage you will be prompted for where in the chain you wish to put the jade module. In this case we want it to run before htmlmin so that our html generated from the jade files will also be minified.

```sh
humphrey module:install serve
```

This will install the serve module. This module starts a local web server on the app directory. It watches the src directory and rebuilds the project and refreshes the browser on any changes. This module does not hook into any of the lifecycle stages, instead it adds it's own grunt task.

```sh
grunt serve
```

A selection of other modules are available at [https://github.com/codeecho/humphrey-modules](https://github.com/codeecho/humphrey-modules)

### Creating your own modules

A module consists of just 2 files

#### module.json

This is a simple json file containing a number of properties about your module eg.

```json
{
	"packages": ["grunt-contrib-jshint"],
	"goal": "validate",
	"tasks": ["jshint"]
}
```

* packages - An array of packages to install from npm for your module eg. ["grunt-jshint"]
* goal - The stage in the lifecycle at which your module should apply. eg. "build". If this is set to a stage that doesn't exist a new one will be created.
* tasks - An array of grunt tasks to call

#### config.js

This javascript file contains the config that you want to add to the grunt config. eg.

```js
{
	jshint: {
		all: ["build/stage/**/*.js"]
	}
}
```

### Managing module repositories

List repositories

```sh
humphrey modules:list-repositories
```

Add a local repository

```sh
humphrey modules:add-local-repository /path/to/your/repository
```

Add a remote repository

```sh
humphrey modules:add-remote-repository http://path/to/your/repository
```

Remove a local repository

```sh
humphrey modules:remove-local-repository /path/to/your/repository
```

Remove a remote repository

```sh
humphrey modules:remove-remote-repository http://path/to/your/repository
```