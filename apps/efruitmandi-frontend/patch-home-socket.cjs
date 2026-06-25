const fs = require("fs");

const file = "src/pages/Home.js";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
`  useEffect(() => {
    let active = true;

    const cancel = scheduleAfterPaint(() => {
      import("../services/socket").then(({ default: socket }) => {
        if (!active) return;
        if (!socket.connected) socket.connect();
        setMarketSocket(socket);
      });
    }, 5000);

    return () => {
      active = false;
      cancel();
    };
  }, []);`,
`  useEffect(() => {
    let active = true;

    const connectMarketSocket = () => {
      import("../services/socket").then(({ default: socket }) => {
        if (!active) return;
        if (!socket.connected) socket.connect();
        setMarketSocket(socket);
      });
    };

    const timer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(connectMarketSocket, { timeout: 8000 });
      } else {
        connectMarketSocket();
      }
    }, 12000);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);`
);

fs.writeFileSync(file, code);
console.log("Deferred Home socket connection.");
