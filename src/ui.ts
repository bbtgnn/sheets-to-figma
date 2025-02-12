import { mount } from "svelte";

import Ui from "./ui.svelte";
import "./ui.css";

export default mount(Ui, {
  target: document.getElementById("app")!,
});
