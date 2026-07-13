import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { load, dump, type Standard } from '@primmel/primmel';

export const useModelStore = defineStore('model', () => {
  const rawText = ref(SAMPLE_MODEL);
  const parseError = ref<string | null>(null);

  const model = computed<Standard | null>(() => {
    try {
      const m = load(rawText.value);
      parseError.value = null;
      return m;
    } catch (e) {
      parseError.value = (e as Error).message;
      return null;
    }
  });

  function setText(text: string) {
    rawText.value = text;
  }

  function format() {
    if (!model.value) return;
    rawText.value = dump(model.value);
  }

  function loadFile(content: string) {
    rawText.value = content;
  }

  return { rawText, parseError, model, setText, format, loadFile };
});

const SAMPLE_MODEL = `root HelloWorld

version "v1.0.0-dev1"

metadata {
  title "Hello World"
  schema "Primmel 0.1"
  namespace "HelloWorld"
}

role Greeter { name "Greeter" }

start_event Start { }
end_event Done { }

process Greet {
  name "Greet the world"
  actor Greeter
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Greet { x 0 y 100 }
    Done  { x 0 y 200 }
  }
  process_flow {
    E1 { from Start to Greet }
    E2 { from Greet to Done }
  }
}`;
