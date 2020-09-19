const router = require('express').Router();
const { findById } = require('../models/subreddit');
const Subreddit = require('../models/subreddit');
const User = require('../models/user');
const { auth } = require('../utils/middleware');

router.get('/', async (_req, res) => {
  const allSubreddits = await Subreddit.find({});
  res.json(allSubreddits);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const subreddit = await Subreddit.findById(id).populate('admin', {
    username: 1,
  });
  res.json(subreddit);
});

router.post('/', auth, async (req, res) => {
  const { subredditName, description } = req.body;

  const admin = await User.findById(req.user);

  if (!admin) {
    return res
      .status(404)
      .send({ message: 'User does not exist in database.' });
  }

  const existingSubName = await Subreddit.findOne({ subredditName });

  if (existingSubName) {
    return res.status(403).send({
      message: `Subreddit having same name "${subredditName}" already exists. Choose another name.`,
    });
  }

  const newSubreddit = new Subreddit({
    subredditName,
    description,
    admin: admin._id,
    subscribedBy: [admin._id],
    subscriberCount: 1,
  });

  const savedSubreddit = await newSubreddit.save();

  admin.subscribedSubs = admin.subscribedSubs.concat(savedSubreddit._id);
  await admin.save();

  return res.status(201).json(savedSubreddit);
});

router.patch('/:id', auth, async (req, res) => {
  const { subredditName, description } = req.body;
  const { id } = req.params;

  const admin = await User.findById(req.user);
  const subreddit = await Subreddit.findById(id);

  if (!admin) {
    return res
      .status(404)
      .send({ message: 'User does not exist in database.' });
  }

  if (!subreddit) {
    return res.status(404).send({
      message: `Subreddit with ID: ${id} does not exist in database.`,
    });
  }

  if (subreddit.admin.toString() !== admin._id.toString()) {
    return res.status(401).send({ message: 'Access is denied.' });
  }

  if (subredditName) {
    subreddit.subredditName = subredditName;
  }

  if (description) {
    subreddit.description = description;
  }

  await subreddit.save();
  res.status(202).json(subreddit);
});

router.patch('/:id/subscribe', auth, async (req, res) => {
  const { id } = req.params;

  const subreddit = await Subreddit.findById(id);
  const user = await User.findById(req.user);

  if (subreddit.subscribedBy.includes(user._id.toString())) {
    subreddit.subscribedBy = subreddit.subscribedBy.filter(
      (s) => s.toString() !== user._id.toString()
    );
    subreddit.subscriberCount = subreddit.subscribedBy.length;
    user.subscribedSubs = user.subscribedSubs.filter(
      (s) => s.toString() !== subreddit._id.toString()
    );
  } else {
    subreddit.subscribedBy = subreddit.subscribedBy.concat(user._id);
    subreddit.subscriberCount = subreddit.subscribedBy.length;
    user.subscribedSubs = user.subscribedSubs.concat(subreddit._id);
  }

  await subreddit.save();
  await user.save();

  res.status(202).end();
});

module.exports = router;