import React, { useState } from 'react';
import { Box, Button, Flex, Heading, Textarea, Select, useToast, Input } from '@chakra-ui/react';
import Card from 'components/Card/Card.js';
import CardHeader from 'components/Card/CardHeader.js';
import CardBody from 'components/Card/CardBody.js';

export default function NotificationManager() {
  const [notification, setNotification] = useState({ title: '', body: '' });
  const [recipientType, setRecipientType] = useState('users');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSend = async () => {
    if (!notification.title || !notification.body) {
      toast({ title: 'Title and message are required', status: 'warning', position: 'top-right' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientType: recipientType,
          title: notification.title,
          body: notification.body,
        }),
      });

      if (response.ok) {
        toast({ title: 'Notification sent successfully', status: 'success', position: 'top-right' });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send notification');
      }
    } catch (error) {
      toast({ title: 'Error sending notification', status: 'error', description: error.message, position: 'top-right' });
    }
    setLoading(false);
  };

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }}>
      <Card>
        <CardHeader p="6px 0px 22px 0px">
          <Heading size="md">Push Notification</Heading>
        </CardHeader>
        <CardBody>
          <Flex direction="column" gap={4}>
            <Select value={recipientType} onChange={(e) => setRecipientType(e.target.value)}>
              <option value="users">Users</option>
              <option value="workers">Workers</option>
            </Select>
            <Input
              placeholder="Title"
              value={notification.title}
              onChange={(e) => setNotification({ ...notification, title: e.target.value })}
            />
            <Textarea
              placeholder="Message"
              value={notification.body}
              onChange={(e) => setNotification({ ...notification, body: e.target.value })}
            />
            <Button colorScheme="orange" onClick={handleSend} isLoading={loading}>
              Send Notification
            </Button>
          </Flex>
        </CardBody>
      </Card>
    </Flex>
  );
}
