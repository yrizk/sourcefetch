'use babel';

import SourcefetchView from './sourcefetch-view';
import { CompositeDisposable } from 'atom';
import request from 'request'
import cheerio from 'cheerio'
import google from 'google'
google.resultsPerPage = 1

/**
TODO: absent an accepted answer, pick something that one would almost be certain has the Answer
TODO: keep looking through google search hits until you find an accepted answers. (this one first)
*/
export default {

  sourcefetchView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.sourcefetchView = new SourcefetchView(state.sourcefetchViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.sourcefetchView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'sourcefetch:fetch': () => this.fetch()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.sourcefetchView.destroy();
  },

  serialize() {
    return {
      sourcefetchViewState: this.sourcefetchView.serialize()
    };
  },

  fetch() {
    let editor
    if (editor = atom.workspace.getActiveTextEditor()) {
      let query = editor.getSelectedText()
      let language = editor.getGrammar().name
      this.search(query, language).then((url) => {
        atom.notifications.addSuccess("found google hit")
        return this.download(url)
      }).then((html) => {
        let answer = this.scrape(html)
        if (answer === '') {
          atom.notifications.addWarning("No Answer found.")
        } else {
          atom.notifications.addSuccess("found snippet")
          editor.insertText(answer)
        }
      }).catch((error) => {
        atom.notifications.addWarning(error.reason)
      })
    }
  },

  download(url) {
    return new Promise((resolve, reject) => {
      request(url, (error, response, body) => {
        if (!error && response.statusCode < 400) {
          resolve(body)
        } else {
          reject({
            reason: 'Unable to download page'
          })
        }
      })
    })
  },

  scrape(html) {
    $ = cheerio.load(html)
    return $('div.accepted-answer pre code').text()
  },

  search(query, language) {
    return new Promise((resolve, reject) => {
      let searchString = `${query} in ${language} site:stackoverflow.com`

      google(searchString, (err, res) => {
        if (err) {
          reject({
            reason: 'A search error has occurred.'
          })
        } else if (res.links.length === 0) {
          reject({
            reason: 'no results found'
          })
        } else {
          resolve(res.links[0].href)
        }
      })
    })
  }
};
