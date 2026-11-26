// Chrome runs the entry as a classic script. The guard also covers immediate injection on a newly enabled site.
const page = globalThis as typeof globalThis & { videoLayersLoaded?: boolean };

if (!page.videoLayersLoaded) {
  page.videoLayersLoaded = true;
  void import("./start");
}
