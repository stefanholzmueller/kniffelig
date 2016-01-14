import {Component, Input, ElementRef, Renderer, OnInit} from 'angular2/core';
import {Category} from './viewmodel';

@Component({
  selector: 'scorefield',
  inputs: ['category'],
  template: `
  <td class="{{cssClass()}}">
  {{scoreText()}}
  </td>
  `,
  styles: [`
  .legal-option {
    background-color: green;
    cursor: pointer;
  }
  .discard-option {
    background-color: red;
    cursor: pointer;
  }
  .scored {
    background-color: lightgrey;
  }
  `]
})
export class ScoreFieldComponent implements OnInit {
  @Input('category') category;
  public cssClass() {
    if (this.category) {
      if (this.category.score !== undefined) {
        return "scored";
      } else if (this.category.option) {
        return "legal-option";
      } else if (this.category.option == null) {
        return "discard-option";
      }
    }
  }
  public scoreText() {
    if (this.category) {
      if (this.category.score !== undefined) {
        return (this.category.score !== null) ? this.category.score : "-";
      } else if (this.category.option) {
        return this.category.option;
      } else if (this.category.option == null) {
        return "-";
      }
    }
  }
  ngOnInit() {
  }
}
