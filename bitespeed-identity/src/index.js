import express from 'express';
import identityRouter from './routes/identity.js';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // parse JSON bodies
app.use(express.urlencoded({ extended: true })); // parse form-data or urlencoded bodies

app.use('/identify', identityRouter); // use identity route

app.get('/', (req, res) => {
  res.send('Server is running...');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
export default app;