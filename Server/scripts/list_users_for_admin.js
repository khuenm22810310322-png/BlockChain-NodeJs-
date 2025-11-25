const mongoose = require('mongoose');
const User = require('../models/Users');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to DB');
    const users = await User.find({}, 'username role');
    console.log('\n--- Registered Users ---');
    users.forEach(u => {
      console.log(`- ${u.username} [${u.role}]`);
    });
    console.log('------------------------\n');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
