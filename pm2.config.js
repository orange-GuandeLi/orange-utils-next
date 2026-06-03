module.exports = {
  apps: [
    {
      name: "orange-utils",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/Users/orange/code/orange-utils-next",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
