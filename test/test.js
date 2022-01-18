const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const chai = require('chai')
chai.Should()
chai.use(require('chai-json-equal'));

let selfData = {}

const app = {
  debug: () => { },
  getSelfPath: (path) => _.get(selfData, path)
}

const plugin = {
  batteries: ['0', '1'],
  engines: ['port'],
  tanks: ['fuel'],
  air: ['outside']
}

function load_calcs() {
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
      if (calc.tests) {
        calc.tests.forEach((test, idx) => {
          it(`${calc.title}[${idx}] works`, (done) => {
            selfData = test.selfData || {}
            let res = calc.calculator.apply(null, test.input)
            if (test.expected) {
              res.should.jsonEqual(test.expected)
            } else if (test.expectedRange) {
              res[0].value.should.closeTo(test.expectedRange[0].value, test.expectedRange[0].delta)
            } else {
              (typeof res).should.equal('undefined')
            }
            done()
          })
        })
      }
    })
  })
})

