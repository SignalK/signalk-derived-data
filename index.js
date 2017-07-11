/*
 * Copyright 2017 Scott Bender <scott@scottbender.net>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const debug = require('debug')('signalk-derived-data')
const Bacon = require('baconjs');
const util = require('util')
const _ = require('lodash')
const path = require('path')
const fs = require('fs')

module.exports = function(app) {
  var plugin = {};
  var unsubscribes = []

  plugin.start = function(props) {
    debug("starting")

    calculations.forEach(calculation => {
      if ( !props[calculation.optionKey] )
        return
      
      unsubscribes.push(
        Bacon.combineWith(
          calculation.calculator,
          calculation.derivedFrom.map(app.streambundle.getSelfStream, app.streambundle)
        )
          .changes()
          .debounceImmediate(20)
          .onValue(values => {
            if ( typeof values !== 'undefined' ) {
              var delta = {
                "context": "vessels." + app.selfId,
                "updates": [
                  {
                    "source": {
                      //"src": key
                    },
                    "timestamp": (new Date()).toISOString(),
                    "values": values
                  }
                ]
              }
              
              debug("got delta: " + JSON.stringify(delta))
              app.handleMessage(plugin.id, delta)
            }
          })
      );
    });

    debug("started")
  }

  plugin.stop = function() {
    debug("stopping")
    unsubscribes.forEach(f => f());
    unsubscribes = [];

    calculations.forEach(calc => {
      if ( calc.stop ) {
        calc.stop()
      }
    });
    
    debug("stopped")
  }

  plugin.id = "derived-data"
  plugin.name = "Derived Data"
  plugin.description = "Plugin that derives data"


  var calculations = load_calcs(app, plugin, 'calcs')

  plugin.schema = {
    title: "Derived Data",
    type: "object",
    properties: {
    }
  }
  
  calculations.forEach(calc => {
    plugin.schema.properties[calc.optionKey] = {
      title: calc.title,
      type: "boolean",
      default: false
    }
  });
 
  debug("schema: " + JSON.stringify(plugin.schema))

  return plugin;
}

function load_calcs (app, plugin, dir) {
  fpath = path.join(__dirname, dir)
  files = fs.readdirSync(fpath)
  return files.map(fname => {
    pgn = path.basename(fname, '.js')
    return require(path.join(fpath, pgn))(app, plugin)
  })
}
