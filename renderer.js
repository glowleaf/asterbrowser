const webview = document.getElementById('webview');

// Handle loading events
webview.addEventListener('did-start-loading', () => {
    console.log('Loading started');
});

webview.addEventListener('did-finish-load', () => {
    console.log('Loading finished');
});

webview.addEventListener('did-fail-load', (error) => {
    console.error('Failed to load:', error);
});

// Handle navigation events
webview.addEventListener('will-navigate', (event) => {
    console.log('Navigating to:', event.url);
});

// Handle crash and unresponsive events
webview.addEventListener('crashed', () => {
    console.error('The page has crashed.');
});

webview.addEventListener('unresponsive', () => {
    console.warn('The page is not responding.');
});

webview.addEventListener('responsive', () => {
    console.log('The page is responsive again.');
}); 