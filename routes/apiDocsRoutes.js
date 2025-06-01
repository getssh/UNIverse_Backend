const express = require('express');
const router = express.Router();
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const loadSwaggerDocument = (filename) => {
    return YAML.load(path.join(__dirname, '../api-docs', filename));
};

const postSwaggerDocument = loadSwaggerDocument('post.yaml');
const groupSwaggerDocument = loadSwaggerDocument('group.yaml');
const chatSwaggerDocument = loadSwaggerDocument('chat.yaml');
const messageSwaggerDocument = loadSwaggerDocument('message.yaml');
const universitySwaggerDocument = loadSwaggerDocument('university.yaml');
const channelSwaggerDocument = loadSwaggerDocument('channel.yaml');
const userSwaggerDocument = loadSwaggerDocument('user.yaml');
const commentsAndReportsSwaggerDocument = loadSwaggerDocument('commentAndReport.yaml');
const eventSwaggerDocument = loadSwaggerDocument('event.yaml')


router.use('/universities', swaggerUi.serve, swaggerUi.setup(universitySwaggerDocument));
router.use('/users', swaggerUi.serve, swaggerUi.setup(userSwaggerDocument));
router.use('/channels', swaggerUi.serve, swaggerUi.setup(channelSwaggerDocument));
router.use('/posts', swaggerUi.serve, swaggerUi.setup(postSwaggerDocument));
router.use('/chats', swaggerUi.serve, swaggerUi.setup(chatSwaggerDocument));
router.use('/messages', swaggerUi.serve, swaggerUi.setup(messageSwaggerDocument));
router.use('/commentsAndReports', swaggerUi.serve, swaggerUi.setup(commentsAndReportsSwaggerDocument));
router.use('/groups', swaggerUi.serve, swaggerUi.setup(groupSwaggerDocument));
router.use('/events', swaggerUi.serve, swaggerUi.setup(eventSwaggerDocument));

module.exports = router;