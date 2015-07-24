#! /usr/bin/env node

var spawn = require('child_process').spawn
var fs = require("fs");
var async = require("async");
var npm = require("npm");
var program = require('commander');
var install = require('spawn-npm-install');
var request = require('request');
var prompt = require('prompt');

var LocalModule = function(path) {
	this.path = path;
	this.getInfo = function(callback) {
		async.waterfall([function(done) {
			fs.readFile(path + "/module.json", {
				encoding: "UTF-8"
			}, done)
		}, function(data, done) {
			done(null, JSON.parse(data));
		}], function(err, config) {
			callback(err, config);
		});
	};
	this.getConfig = function(callback) {
		async.waterfall([function(done) {
			fs.readFile(path + "/config.js", {
				encoding: "UTF-8"
			}, done)
		}], function(err, config) {
			callback(err, config);
		});
	}
}

var RemoteModule = function(url) {
	this.url = url;
	this.getInfo = function(callback) {
		async.waterfall([function(done) {
			request(url + "/module.json", done)
		}, function(response, data, done) {
			done(null, JSON.parse(data));
		}], function(err, config) {
			callback(err, config);
		});
	};
	this.getConfig = function(callback) {
		async.waterfall([function(done) {
			request(url + "/config.js", done)
		}], function(err, response, config) {
			callback(err, config);
		});
	}
}

var LocalModuleRepository = function(path) {
	this.path = path;
	this.getDescription = function() {
		return "local:" + path;
	}
	this.getModule = function(name, callback) {
		fs.exists(path + "/" + name, function(exists) {
			if (exists) {
				callback(null, new LocalModule(path + "/" + name));
			} else {
				callback({
					message: "Module " + name + " doesn't exist"
				});
			}
		});
	}
}

var RemoteModuleRepository = function(url) {
	this.url = url;
	this.getDescription = function() {
		return "remote:" + url;
	}
	this.getModule = function(name, callback) {
		request.head(url + "/" + name + "/module.json", function(err, response) {
			if (err) {
				callback(err);
			} else if (response.statusCode == 404) {
				callback({
					message: "Module " + name + " doesn't exist"
				});
			} else if (response.statusCode != 200) {
				callback({
					message: "Server returned status: " + response.statusCode
				});
			} else {
				callback(null, new RemoteModule(url + "/" + name));
			}
		});
	}
}

var moduleRepositoryFactory = {
	getRepository: function(config, callback) {
		if (config.type == "local") {
			callback(null, new LocalModuleRepository(config.config.path));
		} else if (config.type == "remote") {
			callback(null, new RemoteModuleRepository(config.config.url));
		} else {
			callback({
				message: "Unknown repository type: " + config.type
			});
		}
	}
}

prompt.start();
prompt.message = ">> ";

program.command('init')
	.option("-f, --force", "Force initialisation even if Gruntfile already exists")
	.action(function(options) {
		async.waterfall([
			function(done) {
				fs.exists(process.cwd() + "/package.json", function(exists) {
					if (!exists) {
						done({
							message: "Can't find package.json. Run \"npm init\" before running humphrey."
						});
					} else {
						done();
					}
				});
			},
			function(done) {
				fs.exists(process.cwd() + "/Gruntfile.js", function(exists) {
					done(null, exists);
				});
			},
			function(exists, done) {
				if (exists && !options.force) {
					done({
						message: "This project has already been initialised"
					});
				} else {
					fs.readFile(__dirname + "/Gruntfile.js", done);
				}
			},
			function(data, done) {
				fs.writeFile(process.cwd() + "/Gruntfile.js", data, done);
			},
			function(done) {
				mkdir(process.cwd() + "/src", done);
			},
			function(done) {
				mkdir(process.cwd() + "/test", done);
			},
			function(done) {
				mkdir(process.cwd() + "/src/assets", done);
			},
			function(done) {
				mkdir(process.cwd() + "/src/js", done);
			},
			function(done) {
				mkdir(process.cwd() + "/src/css", done);
			},
			function(done) {
				install(['load-grunt-tasks', 'merge', 'grunt-contrib-clean', 'grunt-contrib-copy'], {
					saveDev: true
				}, done);
			}
		], function(err) {
			if (err) {
				console.log("ERROR: " + err.message);
			}
		});
	});

var exit = "exit";

program.command('modules:list-repositories').action(function() {
	async.waterfall([
		function(done) {
			getConfig(done);
		},
		function(config, done) {
			async.eachSeries(config.modules.repositories, function(repositoryConfig, done) {
				async.waterfall([
					function(done) {
						moduleRepositoryFactory.getRepository(repositoryConfig, done);
					},
					function(moduleRepository, done) {
						console.log(moduleRepository.getDescription());
						done();
					}
				], function(err) {
					done(err);
				});
			}, function(err) {
				done(err);
			});
		}
	], function(err) {
		if (err) {
			console.log("ERROR: " + err.message);
		}
	});
});

program.command('modules:add-local-repository [path]').action(function(path) {
	async.waterfall([
		function(done) {
			getConfig(done);
		},
		function(config, done) {
			config.modules.repositories.push({
				type: "local",
				config: {
					path: path
				}
			});
			saveConfig(config, done);
		}
	], function(err) {
		if (err) {
			console.log("ERROR: " + err.message);
		} else {
			console.log("Repository added successfully");
		}
	});
});

program.command('modules:add-remote-repository [url]').action(function(url) {
	async.waterfall([
		function(done) {
			getConfig(done);
		},
		function(config, done) {
			config.modules.repositories.push({
				type: "remote",
				config: {
					url: url
				}
			});
			saveConfig(config, done);
		}
	], function(err) {
		if (err) {
			console.log("ERROR: " + err.message);
		} else {
			console.log("Repository added successfully");
		}
	});
});

program.command('modules:remove-local-repository [path]').action(function(path) {
	async.waterfall([
		function(done) {
			getConfig(done);
		},
		function(config, done) {
			for (var i = 0; i < config.modules.repositories.length; i++) {
				var repository = config.modules.repositories[i];
				if (repository.type == "local" && repository.config.path == path) {
					config.modules.repositories.splice(i, 1);
					break;
				}
			}
			saveConfig(config, done);
		}
	], function(err) {
		if (err) {
			console.log("ERROR: " + err.message);
		} else {
			console.log("Repository removed successfully");
		}
	});
});

program.command('modules:remove-remote-repository [url]').action(function(url) {
	async.waterfall([
		function(done) {
			getConfig(done);
		},
		function(config, done) {
			for (var i = 0; i < config.modules.repositories.length; i++) {
				var repository = config.modules.repositories[i];
				if (repository.type == "remote" && repository.config.url == url) {
					config.modules.repositories.splice(i, 1);
					break;
				}
			}
			saveConfig(config, done);
		}
	], function(err) {
		if (err) {
			console.log("ERROR: " + err.message);
		} else {
			console.log("Repository removed successfully");
		}
	});
});

program.command('module:install [name]').action(function(name) {
	var info;
	var config;
	var module;
	async.waterfall([
		function(done) {
			getConfig(done);
		},
		function(config, done) {
			async.eachSeries(config.modules.repositories, function(repositoryConfig, done) {
				async.waterfall([
					function(done) {
						moduleRepositoryFactory.getRepository(repositoryConfig, done);
					},
					function(moduleRepository, done) {
						console.log("Checking repository " + moduleRepository.getDescription() + " for module " + name);
						moduleRepository.getModule(name, done);
					}
				], function(err, _module) {
					module = _module;
					var err = module ? exit : null;
					done(err);
				});
			}, function(err) {
				if (err == exit) {
					done(null);
				} else if (err) {
					done(err);
				} else {
					done({
						message: "Module " + name + " not found"
					})
				}
			})
		},
		function(done) {
			module.getInfo(done);
		},
		function(_info, done) {
			info = _info;
			done();
		},
		function(done) {
			module.getConfig(done);
		},
		function(_config, done) {
			config = _config;
			done();
		},
		function(done) {
			console.log("Installing module " + name);
			install(info.packages, {
				saveDev: true
			}, done);
		},
		function(done) {
			fs.readFile(process.cwd() + "/Gruntfile.js", {
				encoding: "UTF-8"
			}, done);
		},
		function(gConfig, done) {
			var subtaskRegex = new RegExp('grunt.registerTask\\(\\"do-' + name + '\\", \\[(.*)\\]\\);');
			var match = subtaskRegex.exec(gConfig);
			if (match) {
				done({
					message: "Module " + name + " already installed"
				});
			} else {
				var taskRegex = new RegExp('grunt.registerTask\\(\\"do-' + info.goal + '\\", \\[(.*)\\]\\);');
				var match = taskRegex.exec(gConfig);
				var subtaskTag = "//<humphrey:subtask:insert>//";
				gConfig = gConfig.replace(subtaskTag, "grunt.registerTask(\"do-" + name + "\", " + JSON.stringify(info.tasks) + ");\n" + subtaskTag);
				if (!match) {
					var taskTag = "//<humphrey:task:insert>//";
					gConfig = gConfig.replace(taskTag, "grunt.registerTask(\"" + name + "\", [\"do-" + name + "\"]);\n" + taskTag);
					done(null, gConfig);
				} else {
					var tasks = JSON.parse("[" + match[1] + "]");
					if (tasks.indexOf("do-" + name) > -1) {
						done({
							message: "Module " + name + " already installed"
						});
					} else {
						if (tasks.length > 0) {
							console.log("Where would you like to insert this task?");
							var i = 0;
							for (i; i < tasks.length; i++) {
								console.log((i + 1) + ": Before " + tasks[i]);
							}
							console.log((i + 1) + ": After " + tasks[i - 1]);
							prompt.get([{
								description: "(" + (tasks.length + 1) + ")",
								name: "index"
							}], function(err, results) {
								console.log(results);
								var index = results.index;
								if (!index || index == "") {
									index = tasks.length + 1;
								}
								try {
									index = eval(index);
								} catch (e) {
									index = tasks.length + 1;
								}
								index = index - 1;
								tasks.splice(index, 0, "do-" + name);
								var result = "grunt.registerTask(\"do-" + info.goal + "\", " + JSON.stringify(tasks) + ");";
								gConfig = gConfig.replace(taskRegex, result);
								done(null, gConfig);
							});
						} else {
							tasks.push("do-" + name);
							var result = "grunt.registerTask(\"do-" + info.goal + "\", " + JSON.stringify(tasks) + ");";
							gConfig = gConfig.replace(taskRegex, result);
							done(null, gConfig);
						}
					}
				}
			}
		},
		function(gConfig, done) {
			var insertTag = "//<humphrey:config:insert>//";
			gConfig = gConfig.replace(insertTag, "merge(config, " + config + ");\n" + insertTag);
			done(null, gConfig);
		},
		function(gConfig, done) {
			if (info.excludes) {
				var publishRegex = /var includes = \[(.*)\];/
				var match = publishRegex.exec(gConfig);
				var includes = JSON.parse("[" + match[1] + "]");
				async.eachSeries(info.excludes, function(exclude, done) {
					includes.push("!" + exclude);
					done();
				}, function(err) {
					var result = "var includes = " + JSON.stringify(includes) + ";";
					gConfig = gConfig.replace(publishRegex, result);
					done(null, gConfig);
				});
			} else {
				done(null, gConfig);
			}
		},
		function(gConfig, done) {
			fs.writeFile(process.cwd() + "/Gruntfile.js", gConfig, done);
		}
	], function(err) {
		if (err) {
			console.log("ERROR: " + err.message);
		} else {
			console.log("Module " + name + " installed successfully");
		}
		process.exit(0);
	})
});

program.parse(process.argv);

function getUserDir() {
	var userDir = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
	return userDir;
}

function getConfig(callback) {
	var userDir = getUserDir();
	async.waterfall([
		function(done) {
			mkdir(userDir + "/.humphrey", done);
		},
		function(done) {
			fs.exists(userDir + "/.humphrey/config.json", function(exists) {
				var defaultConfig = {
					modules: {
						repositories: [{
							type: "local",
							config: {
								path: "/codeecho/code/humphrey-modules/src"
							}
						}]
					}
				};
				if (!exists) {
					saveConfig(defaultConfig, done);
				} else {
					done();
				}
			})
		},
		function(done) {
			fs.readFile(userDir + "/.humphrey/config.json", {
				encoding: "UTF-8"
			}, done);
		},
		function(data, done) {
			done(null, JSON.parse(data));
		}
	], function(err, data) {
		callback(err, data);
	})
}

function saveConfig(config, done) {
	var userDir = getUserDir();
	fs.writeFile(userDir + "/.humphrey/config.json", JSON.stringify(config), done);
}

function mkdir(path, done) {
	fs.exists(path, function(exists) {
		if (!exists) {
			fs.mkdir(path, done);
		} else {
			done();
		}
	});
}