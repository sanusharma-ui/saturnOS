'use strict';

const { getSystemInfo } = require('../lib/sys');

function handleSysinfoGet() {
  return getSystemInfo();
}

module.exports = {
  handleSysinfoGet
};
