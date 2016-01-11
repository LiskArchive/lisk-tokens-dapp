var extend = require('extend');
var util = require('util');
var crypto = require('crypto-browserify');
var bignum = require('browserify-bignum');

var private = {}, self = null,
	library = null, modules = null;

function Token(cb, _library) {
	self = this;
	library = _library;

	cb(null, self);
}

Token.prototype.addToken = function (cb, query) {
	var keypair = modules.api.crypto.keypair(query.secret);

	library.sequence.add(function (cb) {
		modules.blockchain.accounts.getAccount({publicKey: keypair.publicKey.toString('hex')}, function (err, account) {
			if (err) {
				return cb(err.toString());
			}
			if (!account || !account.publicKey) {
				return cb("COMMON.OPEN_ACCOUNT");
			}

			try {
				var transaction = modules.logic.transaction.create({
					type: 5,
					sender: account,
					keypair: keypair,
					name: query.name,
					description: query.description,
					fund: query.fund,
				});
			} catch (e) {
				return cb(e.toString());
			}

			modules.blockchain.transactions.processUnconfirmedTransaction(transaction, cb)
		});
	}, function (err, transaction) {
		if (err) {
			return cb(err.toString());
		}

		cb(null, {transaction: transaction});
	});
}

Token.prototype.getTokens = function (cb, query) {
	var keypair = null;
	if (query.secret) {
		keypair = modules.api.crypto.keypair(query.secret);
	}

	modules.api.dapps.getGenesis(function (err, res) {
		if (err) {
			return cb(err);
		}
		modules.api.sql.select({
			table: "asset_token",
			"alias": "tkn",
			join: [
				{
					"type": "inner",
					"table": "transactions",
					"alias": "t",
					"on": {
						"tkn.transactionId": "t.id"
					}
				}
			],
			fields: [
				{"tkn.transactionId": "transactionId"},
				{"tkn.name": "name"},
				{"t.senderId": "owner"},
				{"tkn.fund": "fund"},
				{"tkn.description": "description"}
			]
		}, {
			"id": String,
			"tiker": String,
			"owner": String,
			"fund": Number,
			"name": String
		}, function (err, tokens) {
			if (keypair) {
				modules.blockchain.accounts.getAccount({publicKey: keypair.publicKey}, function (err, account) {
					tokens.forEach(function (token) {
						token.balance = account.balance[token.tiker] || 0;
					});
					cb(err, {tokens: tokens});
				});
			} else {
				cb(err, {tokens: tokens});
			}
		});
	});
}

Token.prototype.onBind = function (_modules) {
	modules = _modules;
}

module.exports = Token;