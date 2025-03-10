export const playgrounHTML = `

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Apollo Sandbox Playground</title>
</head>
<body>
    <div id="sandbox" style="height: 100vh;"></div>
    <script src="https://embeddable-sandbox.cdn.apollographql.com/_latest/embeddable-sandbox.umd.production.min.js"></script>
    <script>
        // Initialize the Apollo Sandbox
        new window.EmbeddedSandbox({
            target: '#sandbox',
            initialEndpoint: '/graphql', // Replace with your GraphQL endpoint
        });
    </script>
</body>
</html>
`;
