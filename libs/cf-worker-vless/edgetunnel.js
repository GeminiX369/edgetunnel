// ../node_modules/uuid/dist/esm-browser/regex.js
var regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

// ../node_modules/uuid/dist/esm-browser/validate.js
function validate(uuid) {
  return typeof uuid === "string" && regex_default.test(uuid);
}

var validate_default = validate;

// ../node_modules/uuid/dist/esm-browser/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset);
  if (!validate_default(uuid)) {
    throw TypeError("Stringified UUID is invalid");
  }
  return uuid;
}

var stringify_default = stringify;

// vless-js/lib/vless-js.ts
var WS_READY_STATE_OPEN = 1;

function makeReadableWebSocketStream(ws, earlyDataHeader, log) {
  let readableStreamCancel = false;
  return new ReadableStream({
    start(controller) {
      ws.addEventListener("message", async (e) => {
        if (readableStreamCancel) {
          return;
        }
        const vlessBuffer = e.data;
        controller.enqueue(vlessBuffer);
      });
      ws.addEventListener("error", (e) => {
        log("socket has error");
        readableStreamCancel = true;
        controller.error(e);
      });
      ws.addEventListener("close", () => {
        try {
          log("webSocket is close");
          if (readableStreamCancel) {
            return;
          }
          controller.close();
        } catch (error2) {
          log(`websocketStream can't close DUE to `, error2);
        }
      });
      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) {
        log(`earlyDataHeader has invaild base64`);
        safeCloseWebSocket(ws);
        return;
      }
      if (earlyData) {
        controller.enqueue(earlyData);
      }
    },
    pull(controller) {
    },
    cancel(reason) {
      log(`websocketStream is cancel DUE to `, reason);
      if (readableStreamCancel) {
        return;
      }
      readableStreamCancel = true;
      safeCloseWebSocket(ws);
    }
  });
}

function base64ToArrayBuffer(base64Str) {
  if (!base64Str) {
    return { error: null };
  }
  try {
    base64Str = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    const decode = atob(base64Str);
    const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
    return { earlyData: arryBuffer.buffer, error: null };
  } catch (error) {
    return { error };
  }
}

function safeCloseWebSocket(socket) {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN) {
      socket.close();
    }
  } catch (error) {
    console.error("safeCloseWebSocket error", error);
  }
}

function processVlessHeader(vlessBuffer, userID) {
  if (vlessBuffer.byteLength < 24) {
    return {
      hasError: true,
      message: "invalid data"
    };
  }
  const version = new Uint8Array(vlessBuffer.slice(0, 1));
  let isValidUser = false;
  let isUDP = false;
  if (stringify_default(new Uint8Array(vlessBuffer.slice(1, 17))) === userID) {
    isValidUser = true;
  }
  if (!isValidUser) {
    return {
      hasError: true,
      message: "invalid user"
    };
  }
  const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
  const command = new Uint8Array(
    vlessBuffer.slice(18 + optLength, 18 + optLength + 1)
  )[0];
  if (command === 1) {
  } else if (command === 2) {
    isUDP = true;
  } else {
    return {
      hasError: true,
      message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`
    };
  }
  const portIndex = 18 + optLength + 1;
  const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
  const portRemote = new DataView(portBuffer).getUint16(0);
  let addressIndex = portIndex + 2;
  const addressBuffer = new Uint8Array(
    vlessBuffer.slice(addressIndex, addressIndex + 1)
  );
  const addressType = addressBuffer[0];
  let addressLength = 0;
  let addressValueIndex = addressIndex + 1;
  let addressValue = "";
  switch (addressType) {
    case 1:
      addressLength = 4;
      addressValue = new Uint8Array(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
      ).join(".");
      break;
    case 2:
      addressLength = new Uint8Array(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + 1)
      )[0];
      addressValueIndex += 1;
      addressValue = new TextDecoder().decode(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
      );
      break;
    case 3:
      addressLength = 16;
      const dataView = new DataView(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
      );
      const ipv6 = [];
      for (let i = 0; i < 8; i++) {
        ipv6.push(dataView.getUint16(i * 2).toString(16));
      }
      addressValue = ipv6.join(":");
      break;
    default:
      console.log(`invild  addressType is ${addressType}`);
  }
  if (!addressValue) {
    return {
      hasError: true,
      message: `addressValue is empty, addressType is ${addressType}`
    };
  }
  return {
    hasError: false,
    addressType,
    addressRemote: addressValue,
    portRemote,
    rawDataIndex: addressValueIndex + addressLength,
    vlessVersion: version,
    isUDP
  };
}

// index.ts
import { connect } from "cloudflare:sockets";

// dns.ts
var doh = "https://cloudflare-dns.com/dns-query";
var dns = async (domain) => {
  const response = await fetch(`${doh}?name=${domain}`, {
    method: "GET",
    headers: {
      "Accept": "application/dns-json"
    }
  });
  const data = await response.json();
  const ans = data?.Answer;
  return ans?.find((record) => record.type === 1)?.data;
};

const CF_CIDR = [
  [16777216, -256],
  [16843008, -256],
  [134647808, -512],
  [134648320, -256],
  [134866688, -256],
  [134910976, -256],
  [135186176, -256],
  [135186688, -256],
  [135186944, -512],
  [135187456, -256],
  [135384320, -256],
  [135384576, -256],
  [135410176, -256],
  [135426304, -256],
  [135447040, -512],
  [135447552, -256],
  [135464960, -256],
  [135554048, -512],
  [135554816, -256],
  [135559680, -512],
  [135560192, -512],
  [135560704, -256],
  [135593216, -256],
  [135596032, -512],
  [135596544, -256],
  [135597312, -256],
  [135622144, -512],
  [135655168, -256],
  [135760640, -256],
  [135786496, -256],
  [135812864, -256],
  [135852544, -512],
  [135853056, -256],
  [135880704, -512],
  [135919872, -256],
  [135967744, -256],
  [135968256, -256],
  [136003584, -256],
  [136004096, -512],
  [136004608, -512],
  [136007424, -256],
  [136057856, -256],
  [136073728, -256],
  [136084992, -256],
  [136107264, -256],
  [136145152, -256],
  [136177152, -512],
  [136243712, -256],
  [136249856, -256],
  [136290304, -512],
  [136463616, -256],
  [136463872, -512],
  [136497152, -512],
  [136497664, -256],
  [136526080, -256],
  [136526336, -512],
  [136549632, -256],
  [136565504, -256],
  [136632320, -1024],
  [136633344, -256],
  [136653056, -256],
  [136653568, -256],
  [136745728, -256],
  [136745984, -512],
  [136752128, -256],
  [136775168, -256],
  [136778240, -256],
  [136805632, -256],
  [136805888, -256],
  [136825088, -256],
  [136825344, -512],
  [136825856, -1024],
  [136827904, -1024],
  [136845824, -512],
  [136846336, -1024],
  [136866560, -256],
  [136867584, -256],
  [136875008, -256],
  [136905984, -256],
  [136906240, -512],
  [136913920, -512],
  [136983296, -256],
  [136983552, -256],
  [136984064, -512],
  [137011456, -256],
  [137012224, -256],
  [137014272, -256],
  [137032960, -256],
  [137066752, -256],
  [137067008, -512],
  [137093120, -512],
  [137093632, -256],
  [137101312, -1024],
  [137102848, -256],
  [137116160, -256],
  [137116672, -1024],
  [137177344, -256],
  [137177856, -256],
  [137178112, -1024],
  [137191680, -256],
  [137192704, -256],
  [137192960, -256],
  [137194496, -256],
  [137195264, -256],
  [137203712, -1024],
  [137261312, -256],
  [137261568, -512],
  [137262336, -256],
  [137262592, -512],
  [137300224, -256],
  [137300992, -1024],
  [137315584, -256],
  [137316096, -256],
  [137396736, -256],
  [137397248, -512],
  [137397760, -256],
  [400762112, -256],
  [400762368, -512],
  [400768000, -256],
  [1078247424, -256],
  [1097744128, -256],
  [1122748416, -256],
  [1145258240, -256],
  [1542116864, -256],
  [1729491968, -256],
  [1729546240, -1024],
  [1733420032, -256],
  [1745879040, -1048576],
  [1822605312, -4096],
  [1822609920, -512],
  [1822610432, -512],
  [1822611456, -512],
  [1822611968, -256],
  [1822614016, -512],
  [1822616320, -256],
  [1822616576, -1024],
  [1822617600, -2048],
  [1822619648, -512],
  [1822620160, -256],
  [1822620672, -512],
  [-1922744064, -256],
  [-1922743808, -512],
  [-1922743296, -1024],
  [-1922742272, -1024],
  [-1922741248, -512],
  [-1922739712, -512],
  [-1922739200, -1024],
  [-1922737664, -256],
  [-1922737152, -1024],
  [-1922736128, -1024],
  [-1922735104, -256],
  [-1922733056, -512],
  [-1922732544, -256],
  [-1922732032, -4096],
  [-1566703616, -1024],
  [-1566702592, -512],
  [-1566701568, -2048],
  [-1566699520, -4096],
  [-1566695424, -4096],
  [-1566691328, -256],
  [-1566690560, -256],
  [-1566690304, -1024],
  [-1566689280, -2048],
  [-1566685184, -2048],
  [-1566683136, -512],
  [-1566682624, -256],
  [-1566682112, -1024],
  [-1566681088, -2048],
  [-1566679040, -4096],
  [-1566674944, -512],
  [-1566674432, -256],
  [-1566673920, -1024],
  [-1566671872, -1024],
  [-1566670848, -8192],
  [-1566662656, -4096],
  [-1566658560, -256],
  [-1566658048, -512],
  [-1566657536, -1024],
  [-1566656512, -2048],
  [-1566654464, -1024],
  [-1566653440, -256],
  [-1566652928, -512],
  [-1566652416, -2048],
  [-1566650368, -1024],
  [-1566649344, -256],
  [-1566648832, -512],
  [-1566648320, -2048],
  [-1566646272, -1024],
  [-1566645248, -256],
  [-1566644224, -2048],
  [-1566642176, -1024],
  [-1566641152, -512],
  [-1566640128, -1024],
  [-1566638848, -256],
  [-1566638592, -512],
  [-1566638080, -16384],
  [-1566621696, -4096],
  [-1566605312, -32768],
  [-1560587776, -256],
  [-1405091840, -131072],
  [-1404960768, -1024],
  [-1404950528, -2048],
  [-1404895232, -65536],
  [-1404829696, -8192],
  [-1404821504, -2048],
  [-1404819456, -1024],
  [-1404818176, -256],
  [-1404817920, -512],
  [-1404817408, -4096],
  [-1404813312, -4096],
  [-1404809216, -512],
  [-1404808448, -256],
  [-1404808192, -1024],
  [-1404807168, -2048],
  [-1404805120, -4096],
  [-1404801024, -2048],
  [-1404798976, -512],
  [-1404798208, -256],
  [-1404797952, -1024],
  [-1404796928, -4096],
  [-1404792832, -2048],
  [-1404790784, -1024],
  [-1404788480, -256],
  [-1404788224, -512],
  [-1404787712, -1024],
  [-1404786688, -2048],
  [-1404784640, -512],
  [-1404783872, -256],
  [-1404783616, -1024],
  [-1404782592, -2048],
  [-1404779520, -1024],
  [-1404778496, -2048],
  [-1404776448, -2048],
  [-1404774144, -256],
  [-1404773888, -512],
  [-1404773376, -1024],
  [-1404772352, -4096],
  [-1404768256, -2048],
  [-1404766208, -1024],
  [-1404765184, -512],
  [-1404764416, -256],
  [-1404764160, -4096],
  [-1404760064, -256],
  [-1404759552, -512],
  [-1404759040, -1024],
  [-1404755968, -4096],
  [-1404751872, -256],
  [-1404750848, -1024],
  [-1404748800, -1024],
  [-1404747776, -8192],
  [-1404739584, -512],
  [-1404738560, -1024],
  [-1404737280, -256],
  [-1404737024, -512],
  [-1404736512, -1024],
  [-1404735488, -2048],
  [-1404732416, -1024],
  [-1404731392, -4096],
  [-1404727296, -2048],
  [-1404724224, -1024],
  [-1404723200, -4096],
  [-1404718080, -1024],
  [-1404717056, -2048],
  [-1404715008, -4096],
  [-1404710912, -256],
  [-1404710400, -512],
  [-1404709888, -256],
  [-1404708864, -1024],
  [-1404707840, -512],
  [-1404706816, -4096],
  [-1404702464, -256],
  [-1404702208, -256],
  [-1404701696, -1024],
  [-1404700672, -256],
  [-1404700160, -512],
  [-1404699648, -1024],
  [-1404690432, -4096],
  [-1404686336, -512],
  [-1404685568, -256],
  [-1404685312, -1024],
  [-1404684288, -2048],
  [-1404678144, -4096],
  [-1404674048, -4096],
  [-1404669952, -1024],
  [-1404668928, -512],
  [-1404667904, -2048],
  [-1404665856, -2048],
  [-1404663808, -256],
  [-1404663296, -512],
  [-1404662784, -1024],
  [-1404661760, -1024],
  [-1404660736, -512],
  [-1404660224, -256],
  [-1404659712, -1024],
  [-1404658688, -512],
  [-1404658176, -256],
  [-1404657664, -1024],
  [-1404654592, -1024],
  [-1404653568, -2048],
  [-1404651008, -512],
  [-1404650496, -1024],
  [-1404649472, -2048],
  [-1404647424, -256],
  [-1404646912, -512],
  [-1404646400, -1024],
  [-1404645376, -4096],
  [-1404641280, -8192],
  [-1404633088, -256],
  [-1404632576, -512],
  [-1404632064, -1024],
  [-1404631040, -2048],
  [-1404628992, -512],
  [-1404627968, -1024],
  [-1404626944, -2048],
  [-1404612608, -2048],
  [-1404610560, -512],
  [-1404610048, -256],
  [-1404609536, -1024],
  [-1404608512, -2048],
  [-1404605440, -1024],
  [-1404604416, -4096],
  [-1404600320, -2048],
  [-1404598016, -256],
  [-1404597760, -512],
  [-1404597248, -1024],
  [-1404596224, -4096],
  [-1404592128, -8192],
  [-1404583936, -16384],
  [-1376440064, -256],
  [-1376438784, -256],
  [-1376437760, -512],
  [-1376436480, -256],
  [-1181570048, -512],
  [-1133355008, -1024],
  [-1133353984, -256],
  [-1133353472, -512],
  [-1133352448, -512],
  [-1133351936, -256],
  [-1133351168, -256],
  [-1101139968, -4096],
  [-1007519232, -512],
  [-974458880, -1024],
  [-970358528, -256],
  [-970342400, -4096],
  [-970338304, -512],
  [-970337536, -256],
  [-970337280, -256],
  [-970336768, -512],
  [-970336256, -2048],
  [-970334208, -2048],
  [-970332160, -512],
  [-970331136, -1024],
  [-970330112, -512],
  [-970329600, -256],
  [-958792960, -256],
  [-954499072, -1024],
  [-954498048, -256],
  [-954497536, -512]
];

function isIp4InCidr(ipStr, cidr) {
  const [a, b, c, d] = ipStr.split(".").map(Number);
  const ipInt = a << 24 | b << 16 | c << 8 | d;
  const [range, mask] = cidr;
  return (ipInt & mask) === range;
}

export function isCloudFlareIP(ip) {
  return CF_CIDR.some((cidr) => isIp4InCidr(ip, cidr));
}

// index.ts
var HTML404 = "emotional damage";

function delay2(ms) {
  return new Promise((resolve, rej) => {
    setTimeout(resolve, ms);
  });
}

var workers_default = {
  async fetch(request, env, ctx) {
    let address = "";
    let portWithRandomLog = "";
    const userID = env.UUID || "82d5348b-7164-460f-bd7f-4b941b334536";
    const log = (info, event) => {
      console.log(`[${address}:${portWithRandomLog}] ${info}`, event || "");
    };
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response(HTML404, {
        status: 404,
        headers: new Headers({ "Content-Type": "text/html" })
      });
    }
    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);
    const earlyDataHeader = request.headers.get("sec-websocket-protocol") || "";
    let remoteSocket = null;
    webSocket.accept();
    const readableWebSocketStream = makeReadableWebSocketStream(
      webSocket,
      earlyDataHeader,
      log
    );
    let vlessResponseHeader = new Uint8Array([0, 0]);
    let remoteConnectionReadyResolve;
    readableWebSocketStream.pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          if (remoteSocket) {
            const writer2 = remoteSocket.writable.getWriter();
            await writer2.write(chunk);
            writer2.releaseLock();
            return;
          }
          const {
            hasError,
            message,
            portRemote,
            addressType,
            addressRemote,
            rawDataIndex,
            vlessVersion,
            isUDP
          } = processVlessHeader(chunk, userID);
          address = addressRemote || "";
          portWithRandomLog = `${portRemote} -- ${isUDP ? "udp " : "tcp "} `;
          if (isUDP && portRemote != 53) {
            controller.error("UDP proxy only enable for DNS which is port 53");
            webSocket.close();
            return;
          }
          if (hasError) {
            controller.error(message);
            webSocket.close();
            return;
          }
          vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
          const rawClientData = chunk.slice(rawDataIndex);
          let queryip = "";
          if (addressType === 2) {
            queryip = await dns(addressRemote);
            if (queryip && isCloudFlareIP(queryip)) {
              queryip = "192.203.230." + Math.floor(Math.random() * 255);
            }
          }
          remoteSocket = connect({
            hostname: queryip ? queryip : addressRemote,
            port: portRemote
          });
          log(`connected`);
          const writer = remoteSocket.writable.getWriter();
          await writer.write(rawClientData);
          writer.releaseLock();
          remoteConnectionReadyResolve(remoteSocket);
        },
        close() {
          console.log(
            `[${address}:${portWithRandomLog}] readableWebSocketStream is close`
          );
        },
        abort(reason) {
          console.log(
            `[${address}:${portWithRandomLog}] readableWebSocketStream is abort`,
            JSON.stringify(reason)
          );
        }
      })
    );
    (async () => {
      await new Promise((resolve) => remoteConnectionReadyResolve = resolve);
      let count = 0;
      remoteSocket.readable.pipeTo(
        new WritableStream({
          start() {
            if (webSocket.readyState === WebSocket.READY_STATE_OPEN) {
              webSocket.send(vlessResponseHeader);
            }
          },
          async write(chunk, controller) {
            if (webSocket.readyState === WebSocket.READY_STATE_OPEN) {
              if (count++ > 2e4) {
                await delay2(1);
              }
              webSocket.send(chunk);
            } else {
              controller.error(
                "webSocket.readyState is not open, maybe close"
              );
            }
          },
          close() {
            console.log(
              `[${address}:${portWithRandomLog}] remoteConnection!.readable is close`
            );
          },
          abort(reason) {
            console.error(
              `[${address}:${portWithRandomLog}] remoteConnection!.readable abort`,
              reason
            );
          }
        })
      ).catch((error) => {
        console.error(
          `[${address}:${portWithRandomLog}] processWebSocket has exception `,
          error.stack || error
        );
        safeCloseWebSocket2(webSocket);
      });
    })();
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
};

function safeCloseWebSocket2(ws) {
  try {
    if (ws.readyState !== WebSocket.READY_STATE_CLOSED) {
      ws.close();
    }
  } catch (error) {
    console.error("safeCloseWebSocket error", error);
  }
}

export {
  workers_default as default
};
//# sourceMappingURL=index.js.map
