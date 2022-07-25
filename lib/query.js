const queryString = require('query-string');

exports.parse = query => {
    if (!query) return {};
    query = query.replaceAll(";", "&");
    return queryString.parse(query, {
        parseNumbers: true,
        parseBooleans: true,
        arrayFormat: 'separator', arrayFormatSeparator: ','
    });
}
