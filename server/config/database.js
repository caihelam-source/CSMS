const mongoose = require('mongoose');
const { safeMongoUri } = require('../utils/mongoUri');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(safeMongoUri(process.env.MONGODB_URI), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
