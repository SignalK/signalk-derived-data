const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const chai = require('chai')
chai.Should()
chai.use(require('chai-json-equal'));

const app = {
  debug: () => {},
  getSelfPath: (path) => {}
}

const plugin = {
  batteries: [ '0', '1' ],
  engines: [ 'port' ],
  tanks: ['fuel']
}

function load_calcs () {
  fpath = path.join(__dirname, '../calcs')
  files = fs.readdirSync(fpath)
  return files
    .map(fname => {
      pgn = path.basename(fname, '.js')
      return require(path.join(fpath, pgn))(app, plugin)
    })
    .filter(calc => {
      return typeof calc !== 'undefined'
    })
}



describe('derived data converts', function () {
  let calcs = load_calcs()

  calcs.forEach(calci => {
    (_.isArray(calci) ? calci : [calci]).forEach(calc => {
      if ( calc.tests ) {
        calc.tests.forEach((test, idx) => {
          it(`${calc.title}[${idx}] works`, (done) => {
            let res = calc.calculator.apply(null, test.input)
            res.should.jsonEqual(test.expected)
            done()
          })
        })
      }
    })
  })
})

