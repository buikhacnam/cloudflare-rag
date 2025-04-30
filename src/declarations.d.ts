declare module '*.html' {
    const content: string;
    export default content;
}

// Removed declarations for *.css and *.js as they are no longer imported separately 