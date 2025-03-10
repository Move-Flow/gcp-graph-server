export const playgrounHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>GraphQL Playground</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@apollo/sandbox/dist/index.css" />
</head>
<body style="margin: 0; overflow-x: hidden; overflow-y: hidden">
    <div style="width: 100vw; height: 100vh;" id="sandbox"></div>
    <script src="https://cdn.jsdelivr.net/npm/@apollo/sandbox/dist/index.umd.js"></script>
    <script>
        new window.EmbeddedSandbox({
            target: '#sandbox',
            initialEndpoint: '/graphql',
        });
    </script>
</body>
</html>
`;
