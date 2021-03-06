'use strict'

const execa = require('execa')
const moment = require('moment')

function substitute(str, o) {
  return str.replace(/\\?\{([^{}]+)\}/g, (match, name) => {
    if (match.charAt(0) === '\\') {
      return match.slice(1)
    }

    return o[name] === undefined ? '' : o[name]
  })
}

module.exports = {
  website: {
    assets: './assets',
    css: ['style.css']
  },

  filters: {
    timeFormat(time, format) {
      return moment(time).format(format || moment.defaultFormat)
    }
  },

  hooks: {
    page(page) {
      const defaults = {
        position: 'bottom',
        createTpl: 'Created by {user} at {timeStamp}',
        modifyTpl: 'Last modified by {user} at {timeStamp}',
        timeStampFormat: 'YYYY-MM-DD HH:mm:ss'
      }
      const bookRoot = this.resolve('')
      const pluginConfig = this.config.get('pluginsConfig')['git-author']
      const options = Object.assign({}, defaults, pluginConfig)

      const {position} = options
      const {createTpl} = options
      const {modifyTpl} = options
      const {timeStampFormat} = options

      return execa
        .shell(`git log --format="%an|%at" -- "${page.rawPath}"`, {
          cwd: bookRoot
        })
        .then(ret => {
          // None commit to this file
          if (!ret.stdout) {
            this.log.debug(`none commit to file ${page.path}`)
            return page
          }

          const commits = ret.stdout.split(/\r?\n/).map(log => {
            const arr = log.split('|')
            const timeStamp = moment(arr[1] * 1000).format(timeStampFormat)

            return {
              user: arr[0],
              timestamp: timeStamp,
              timeStamp
            }
          })

          const lastCommit = commits[0]
          const firstCommit = commits.slice(-1)[0]

          let gitAuthorContent = `<div class="git-author-container git-author-${position}">`

          if (modifyTpl) {
            const modifyMsg = substitute(modifyTpl, lastCommit)
            gitAuthorContent += `<div class="modified">${modifyMsg}</div>`
          }

          if (createTpl) {
            const createMsg = substitute(createTpl, firstCommit)
            gitAuthorContent += `<div class="created">${createMsg}</div>`
          }

          gitAuthorContent += '</div>'

          if (position === 'top') {
            page.content = gitAuthorContent + page.content
          } else {
            page.content += gitAuthorContent
          }

          return page
        })
        .catch(error => {
          this.log.warn('initialize git repository and commit files firstly')
          this.log.warn(error)
          return page
        })
    }
  }
}
