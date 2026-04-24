import Docker from "dockerode";
import { images } from "../images.ts";
import type { IncomingMessage } from "node:http";

const docker = new Docker();

const pulls = Object.values(images).map(
  (image) =>
    new Promise<void>((resolve, reject) => {
      console.log(`Pulling image ${image} ...`);
      docker.pull(image, function (err: Error | null, stream: IncomingMessage) {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err) => {
          if (err) return reject(err);
          console.log(`Image ${image} pulled successfully`);
          resolve();
        });
      });
    }),
);

await Promise.all(pulls);
process.exit(0);
