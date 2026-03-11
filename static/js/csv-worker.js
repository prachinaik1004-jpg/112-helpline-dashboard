// Web Worker for CSV parsing
importScripts('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');

self.onmessage = function(e) {
  if (e.data.action === 'parse') {
    Papa.parse(e.data.url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (results.errors && results.errors.length > 0) {
          self.postMessage({ error: 'CSV parsing error: ' + results.errors[0].message });
        } else {
          // Send back only the data we need
          const filteredData = results.data.map(row => ({
            EVENT_ID: row.EVENT_ID,
            EVENT_MAIN_TYPE: row.EVENT_MAIN_TYPE,
            Police_Station_Name: row.Police_Station_Name,
            CREATE_TIME: row.CREATE_TIME,
            CLOSURE_COMMENTS: row.CLOSURE_COMMENTS,
            RESPONSE_TIME: row.RESPONSE_TIME,
            EVENT_INFORMATION: row.EVENT_INFORMATION
          }));
          self.postMessage(filteredData);
        }
      },
      error: function(error) {
        self.postMessage({ error: 'Failed to load CSV: ' + error.message });
      }
    });
  }
};
