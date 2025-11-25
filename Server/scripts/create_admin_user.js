const mongoose = require('mongoose');
const User = require('../models/Users');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to DB');
    
    const username = 'admin';
    const password = 'admin123';
    
    let user = await User.findOne({ username });
    
    if (user) {
      console.log(`User '${username}' already exists. Updating role to admin...`);
      user.role = 'admin';
      // We don't change password if user exists, to avoid locking them out if it was a real user
      // But since 'admin' wasn't in the list, this block might not be hit.
      // If it was hit, we'd need to be careful. 
      // But for this specific request "Add admin", if 'admin' exists, ensuring they are admin is good.
    } else {
      console.log(`Creating new user '${username}'...`);
      user = new User({
        username,
        password, // Will be hashed by pre-save hook
        role: 'admin'
      });
    }
    
    await user.save();
    console.log(`Successfully configured user '${username}' as Admin.`);
    console.log(`Password: ${password} (if new account)`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
