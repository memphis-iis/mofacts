Template.tabwarning.events({
  'click #takeOverSession': function(event) {
    console.log('takeOverSession clicked!');
    event.preventDefault();
    event.stopPropagation();

    // Force this tab to take over the session
    const currentSessionId = Meteor.default_connection?._lastSessionId || Meteor.connection?._lastSessionId || null;
    const currentSessionIdTimestamp = Date.now();

    console.log('Updating session:', currentSessionId, currentSessionIdTimestamp);

    // Update local session tracking FIRST
    Session.set('lastSessionId', currentSessionId);
    Session.set('lastSessionIdTimestamp', currentSessionIdTimestamp);

    // Set a flag to ignore broadcast messages temporarily (this tab is taking over)
    Session.set('ignoreBroadcastUntil', Date.now() + 2000); // Ignore for 2 seconds

    // Update server session
    (async () => {
      try {
        await Meteor.callAsync('setUserSessionId', currentSessionId, currentSessionIdTimestamp);
        console.log('Server session updated successfully');
      } catch (error) {
        console.error('Error setting user session:', error);
        alert('Error taking over session: ' + error.message);
      }
    })();

    // Generate a DIFFERENT tab ID for the broadcast (not this tab's ID)
    const broadcastTabId = Math.random().toString(36).substr(2, 9);

    // Broadcast to other tabs that this tab is taking over
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('mofacts-tabs');
        channel.postMessage({ type: 'new-tab-opened', tabId: broadcastTabId });
        channel.close();
        console.log('Broadcast sent via BroadcastChannel');
      } catch (e) {
        console.log('BroadcastChannel failed:', e);
        // BroadcastChannel failed, use localStorage fallback
        localStorage.setItem('mofacts-active-tab', broadcastTabId);
      }
    } else {
      // Use localStorage for older browsers
      console.log('Using localStorage fallback');
      localStorage.setItem('mofacts-active-tab', broadcastTabId);
    }

    // Redirect immediately (don't wait for callback)
    console.log('Redirecting to /profile');
    Router.go('/home');
  }
});
