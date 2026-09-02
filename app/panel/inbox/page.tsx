import React from 'react';
import InboxClient from './inbox-client';

export default function InboxPage() {
  return (
    <div className="flex-1 overflow-hidden h-[calc(100vh-64px)]">
      <InboxClient />
    </div>
  );
}
