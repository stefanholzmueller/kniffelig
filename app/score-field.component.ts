import {Component} from 'angular2/core';
@Component({
  inputs: ['category'],
  selector: 'score-field',
  template: `
  {{category.value}}
  `
})
export class ScoreFieldComponent {
}
