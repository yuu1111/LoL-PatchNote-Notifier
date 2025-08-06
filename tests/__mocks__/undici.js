/**
 * Mock for undici module
 * Node.js環境でのundiciモジュールの互換性問題を回避
 */

module.exports = {
  fetch: global.fetch || jest.fn(),
  Request: global.Request || class Request {},
  Response: global.Response || class Response {},
  Headers: global.Headers || class Headers {},
  FormData: global.FormData || class FormData {},
  File: global.File || class File {},
  FileReader: global.FileReader || class FileReader {},
};