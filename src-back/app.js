import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/ping', (req, res) => {
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
