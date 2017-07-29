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

    plugin.properties = props;

    calculations.forEach(calculation => {
      
      if ( calculation.group ) {
        if ( !props[calculation.group] || !props[calculation.group][calculation.optionKey] ) {
          return
        }
      } else if ( !props[calculation.optionKey] ) {
        return
      }

      var derivedFrom;

      if ( typeof calculation.derivedFrom == 'function' )
        derivedFrom = calculation.derivedFrom()
      else
        derivedFrom = calculation.derivedFrom

      var skip_function
      if ( (typeof calculation.ttl !== 'undefined' && calculation.ttl > 0)
           || props.default_ttl > 0 ) {
        //debug("using skip")  
        skip_function = function(before, after) {
          var tnow = (new Date()).getTime();
          if ( _.isEqual(before,after) ) {
            // values are equial, but should we emit the delta anyway.
            // This protects from a sequence of changes that produce no change from
            // generating events, but ensures events are still generated at 
            // a default rate. On  Pi Zero W, the extra cycles reduce power consumption.
            if ( calculation.nextOutput > tnow ) {
              //console.log("Rejected dupilate ", calculation.nextOutput - tnow);
              return true;
            }
           //console.log("Sent dupilate ", calculation.nextOutput - tnow);
          }

          var ttl = typeof calculation.ttl === 'undefined' ? props.default_ttl : calculation.ttl;
          //debug("ttl: " + ttl, "def: " + props.default_ttl)
          
          calculation.nextOutput = tnow + (ttl*1000);
          //console.log("New Value ----------------------------- ", before, after);
          return false;
        }
      } else {
        skip_function = function(before, after) { return false }
      }
      
      unsubscribes.push(
        Bacon.combineWith(
          calculation.calculator,
          derivedFrom.map(app.streambundle.getSelfStream, app.streambundle)
        )
          .changes()
          .debounceImmediate(20)
          .skipDuplicates(skip_function)
          .onValue(values => {
            if ( typeof values !== 'undefined' ) {
              var delta = {
                "context": "vessels." + app.selfId,
                "updates": [
                  {
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
  calculations = [].concat.apply([], calculations)

  plugin.schema = {
    title: "Derived Data",
    type: "object",
    properties: {
      default_ttl: {
        title: "Default TTL",
        type: "number",
        description: "The plugin won't send out duplicate calculation values for this time period (s) (0=no ttl check)",
        default: 0
      }
    }
  }

  var groups = {}

  calculations.forEach(calc => {
    var groupName

    if ( typeof calc.group !== 'undefined' ) {
      groupName = calc.group
    } else {
      groupName = 'nogroup'
    }
      
    if ( !(groups[groupName]) ) {
      groups[groupName] = []
    }
    groups[groupName].push(calc)
  });

  plugin.uiSchema = {
    "ui:order": [ "default_ttl" ]
  };

  if ( groups.nogroup ) {
    groups.nogroup.forEach(calc => {
      plugin.uiSchema['ui:order'].push(calc.optionKey)
      plugin.schema.properties[calc.optionKey] = {
        title: calc.title,
        type: "boolean",
        default: false
      }
      if ( calc.properties ) {
        _.extend(plugin.schema.properties, calc.properties)
      }
    });
  }

  _.keys(groups).forEach(groupName => {
    if ( groupName != 'nogroup' ) {
      plugin.uiSchema['ui:order'].push(groupName)
      plugin.uiSchema[groupName] = {
        'ui:order': []
      };
      var group = {
        title: groupName.charAt(0).toUpperCase() + groupName.slice(1),
        type: "object",
        properties: {}
      }
      groups[groupName].forEach(calc => {
        var order = plugin.uiSchema[groupName]['ui:order']
        order.push(calc.optionKey)
        group.properties[calc.optionKey] = {
        title: calc.title,
          type: "boolean",
          default: false
        }
        if ( calc.properties ) {
          _.extend(group.properties, calc.properties)
          _.keys(calc.properties).forEach(key => { order.push(key) })
        }
      });
      plugin.schema.properties[groupName] = group;
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
    return require(path.join(fpath, pgn))(app, plugin);
  }).filter(calc => { return typeof calc !== 'undefined'; });
}
