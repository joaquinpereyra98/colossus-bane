import ColossusBaneModule from "./module/colossus-bane-module.mjs";
import * as hooks from "./module/hooks/_module.mjs";
import * as canvas from "./module/canvas/_module.mjs";
import * as CONSTANTS from "./module/constants.mjs";

Hooks.on("init", () => {
  ColossusBaneModule.init();
});

Hooks.on("canvasInit", (c) => {
  if (c.tokens[CONSTANTS.MODULE_KEY] instanceof canvas.TokenConnections) return;
  c.tokens[CONSTANTS.MODULE_KEY] = new canvas.TokenConnections();
});


Hooks.on("refreshToken", hooks.onRefreshToken);
Hooks.on("drawTokenLayer", hooks.onDrawTokenLayer);
Hooks.on("destroyToken", hooks.onDestroyToken);
