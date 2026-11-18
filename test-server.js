const express = require('express');

const app = express();

app.get('/', (req, res) => {
    res.send('Hello! Express is working!');
});

app.listen(8000, '127.0.0.1', () => {
    console.log('Test server running on port 8000');
});