let express = require('express');
let router = express.Router();
let gameManager = require('./index').gameManager;
var bodyParser = require('body-parser')
const { check } = require('express-validator');
let Player = require('./player');

// BodyParser to read form data
router.use(bodyParser.urlencoded({ extended: true }));

// // Handle a join game request
// router.post('/joinGame', [check('name').escape()], function (req, res) {
//     /*
//     - Update the host, producer etc. views
//     */
//     let player = new Player(req.body.name, null, null);
//     gameManager.createPlayer(player);
//     res.json({status: "logingin"});
// });

router.get('/test', function(req, res)
{
    res.json({status: "logingin"});
});

module.exports = router;