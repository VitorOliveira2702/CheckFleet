import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { instalarFerramentasTeste } from './app/teste/ferramentas-teste';

bootstrapApplication(App, appConfig)
  .then((app) => instalarFerramentasTeste(app.injector))
  .catch((err) => console.error(err));
