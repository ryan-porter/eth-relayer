// Simple server for basic functionality
const express = require('express');
const app = express();
const sql = require('./lib/sql.js');
const bodyParser = require('body-parser');
const commands = require('./lib/sqlCommands.js');
const signing = require('../lib/signing.js');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


// Deposit tokens. Expects an event with args (see TrustedRelay.sol Deposit events)
app.post('/deposit', (req, res) => {
  sql.run(req.body, commands.deposit)
  .then(() => {
    return sql.query(req.body.sig.m, commands.getDepositId)
  })
  .then((id) => { res.send({ status: 200, id: id[0].id }); })
  .catch((err) => { res.send({ status: 500, error: err }); })
})

// Sign a message that can be used by a user to move the tokens. Must contain:
// { fromChain, toChain, oldToken, sender, amount, fee, timestamp }
app.get('/sign', (req, res) => {
  const sig = signing.hashAndSign(req.query)
  res.send({ status: 200, result: sig })
})

// Relay a message
app.post('/relay', (req, res) => {
  let depositId;
  let relayId;
  let data = req.body;
  sql.query(data.hash, commands.getDepositId)
  .then((_id) => {
    depositId = _id.length > 0 ? _id[0].id : '';
    data.depositId = depositId;
    return sql.run(data, commands.relay)
  })
  .then(() => {
    return sql.query(data.hash, commands.getRelayId)
  })
  .then((_id) => {
    relayId = _id.length > 0 ? _id[0].id : '';
    return sql.run({ relayId, depositId }, commands.insertRelayId)
  })
  .then(() => {
    return sql.run({ relayId, depositId }, commands.insertDepositId)
  })
  .then(() => { res.send({ status: 200, success: true }); })
  .catch((err) => { res.send({ status: 500, error: err }); })
})

// Get deposits (all or pending)
// {
//   user: <string>     // 0x prefixed address
//   toChainId: <string> // address of the Gateway in the toChain
//   pending: <bool>    // if true, only return pending deposits (no relay_id)
//   n: <string>        // (optional, default 100) max results returned
// }
app.get('/deposits', (req, res) => {
  sql.query(req.query, commands.getDeposits)
  .then((rows) => { res.send({ status: 200, result: rows }); })
  .catch((err) => { res.send({ status: 500, error: err }); })
})


// Start server
const PORT = 3000;
app.listen(PORT, () => { console.log(`Server listening on port ${PORT}`)})
