import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as BUIC from "@thatopen/ui-obc";
import Stats from "stats.js";

// -------------------------------------------------------
// 1. UI INIT
// -------------------------------------------------------
BUI.Manager.init();

// -------------------------------------------------------
// 2. SCENE SETUP
// -------------------------------------------------------
const viewport = document.createElement("bim-viewport");

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.SimpleCamera,
  OBC.SimpleRenderer
>();

world.name = "main";
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = null;

world.renderer = new OBC.SimpleRenderer(components, viewport);
world.camera = new OBC.SimpleCamera(components);
await world.camera.controls.setLookAt(65, 19, -27, 12.6, -5, -1.4);

viewport.addEventListener("resize", () => {
  (world.renderer as OBC.SimpleRenderer).resize();
  (world.camera as OBC.SimpleCamera).updateAspect();
});

components.init();
components.get(OBC.Grids).create(world);

// -------------------------------------------------------
// 3. FRAGMENTS MANAGER
// -------------------------------------------------------
const githubUrl =
  "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
const fetchedUrl = await fetch(githubUrl);
const workerBlob = await fetchedUrl.blob();
const workerFile = new File([workerBlob], "worker.mjs", {
  type: "text/javascript",
});
const workerUrl = URL.createObjectURL(workerFile);

const fragments = components.get(OBC.FragmentsManager);
fragments.init(workerUrl);

world.camera.controls.addEventListener("update", () =>
  fragments.core.update(true)
);

fragments.list.onItemSet.add(({ value: model }) => {
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  fragments.core.update(true);
});

fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  if (!("isLodMaterial" in material && material.isLodMaterial)) {
    material.polygonOffset = true;
    material.polygonOffsetUnits = 1;
    material.polygonOffsetFactor = Math.random();
  }
});

// -------------------------------------------------------
// 4. IFC LOADER
// -------------------------------------------------------
const ifcLoader = components.get(OBC.IfcLoader);

await ifcLoader.setup({
  autoSetWasm: false,
  wasm: {
    path: "https://unpkg.com/web-ifc@0.0.74/",
    absolute: true,
  },
});

const loadIfc = async (path: string) => {
  const file = await fetch(path);
  const data = await file.arrayBuffer();
  const buffer = new Uint8Array(data);
  await ifcLoader.load(buffer, false, "model", {
    processData: {
      progressCallback: (progress) => console.log("Loading:", progress),
    },
  });
};

const loadIfcFromFile = async (file: File) => {
  const data = await file.arrayBuffer();
  const buffer = new Uint8Array(data);
  await ifcLoader.load(buffer, false, file.name.replace(".ifc", ""), {
    processData: {
      progressCallback: (progress) => console.log("Loading:", progress),
    },
  });
};

const downloadFragments = async () => {
  const [model] = fragments.list.values();
  if (!model) return;
  const fragsBuffer = await model.getBuffer(false);
  const fragFile = new File([fragsBuffer], "model.frag");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(fragFile);
  link.download = fragFile.name;
  link.click();
  URL.revokeObjectURL(link.href);
};

// -------------------------------------------------------
// 5. HIGHLIGHTER
// -------------------------------------------------------
const highlighter = components.get(OBCF.Highlighter);
highlighter.setup({ world });

// -------------------------------------------------------
// 6. PROPERTIES TABLE
// -------------------------------------------------------
const [propertiesTable, updatePropertiesTable] = BUIC.tables.itemsData({
  components,
  modelIdMap: {},
});

propertiesTable.preserveStructureOnFilter = true;
propertiesTable.indentationInText = false;

highlighter.events.select.onHighlight.add((modelIdMap) => {
  updatePropertiesTable({ modelIdMap });
});

highlighter.events.select.onClear.add(() => {
  updatePropertiesTable({ modelIdMap: {} });
});

// -------------------------------------------------------
// 7. PANELS
// -------------------------------------------------------

// Left panel — properties
const [propertiesPanel, updatePropertiesPanel] = BUI.Component.create<BUI.Panel, {}>((_) => {
  let downloadBtn: BUI.TemplateResult | undefined;
  if (fragments.list.size > 0) {
    downloadBtn = BUI.html`
      <bim-button label="Download Fragments" icon="solar:download-bold" @click=${downloadFragments}></bim-button>
    `;
  }

  const onTextInput = (e: Event) => {
    const input = e.target as BUI.TextInput;
    propertiesTable.queryString = input.value !== "" ? input.value : null;
  };

  const expandTable = (e: Event) => {
    const button = e.target as BUI.Button;
    propertiesTable.expanded = !propertiesTable.expanded;
    button.label = propertiesTable.expanded ? "Collapse" : "Expand";
  };

  const copyAsTSV = async () => {
    await navigator.clipboard.writeText(propertiesTable.tsv);
  };

  const onLoadIfc = async ({ target }: { target: BUI.Button }) => {
    target.label = "Converting...";
    target.loading = true;
    await loadIfc(
      "https://thatopen.github.io/engine_components/resources/ifc/school_str.ifc"
    );
    target.loading = false;
    target.label = "Load IFC (demo)";
  };

  const onUploadIfc = async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ifc";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.label = "Converting...";
      target.loading = true;
      await loadIfcFromFile(file);
      target.loading = false;
      target.label = "Upload IFC";
    };
    input.click();
  };

  return BUI.html`
    <bim-panel label="Properties" style="margin: 0.5rem 0 0.5rem 0.5rem;">
      <bim-panel-section label="IFC">
        <bim-button label="Load IFC (demo)" icon="solar:upload-bold" @click=${onLoadIfc}></bim-button>
        <bim-button label="Upload IFC" icon="solar:file-bold" @click=${onUploadIfc}></bim-button>
        ${downloadBtn}
      </bim-panel-section>
      <bim-panel-section label="Element Data">
        <div style="display: flex; gap: 0.5rem;">
          <bim-button @click=${expandTable} label="Expand"></bim-button>
          <bim-button @click=${copyAsTSV} label="Copy as TSV"></bim-button>
        </div>
        <bim-text-input @input=${onTextInput} placeholder="Search property..." debounce="250"></bim-text-input>
        ${propertiesTable}
      </bim-panel-section>
    </bim-panel>
  `;
}, {});

fragments.list.onItemSet.add(() => updatePropertiesPanel());

// -------------------------------------------------------
// 8. GRID LAYOUT
// -------------------------------------------------------
const app = document.createElement("bim-grid") as BUI.Grid<["main"]>;
app.layouts = {
  main: {
    template: `
      "propertiesPanel viewport"
      / 25rem 1fr
    `,
    elements: { propertiesPanel, viewport },
  },
};
app.layout = "main";
document.body.append(app);

// -------------------------------------------------------
// 9. PERFORMANCE STATS
// -------------------------------------------------------
const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = "0px";
stats.dom.style.zIndex = "unset";
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());