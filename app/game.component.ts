import {Component} from 'angular2/core';
import {OnInit} from 'angular2/core';
import {ScoreFieldDirective} from './score-field.directive';
import {ViewModel, Category} from './viewmodel';

@Component({
  directives: [ScoreFieldDirective],
  selector: 'game',
  templateUrl: 'app/game.component.html',
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
export class GameComponent implements OnInit {
  public vm: ViewModel = {
    dice: [1,2,3,4,5],
    rerolls: 0,
    categories: [
      { name: 'Aces', score: 1 },
      { name: 'Twos', option: 2 },
      { name: 'Threes', option: null }
    ],
    totalUpper: 0,
    bonus: 0,
    totalLower: 0,
    total: 0
  };
  ngOnInit() {
  }
  findCategory(categoryName) {
    return this.vm.categories.find((elem) => elem.name === categoryName);
  }
  score(category) {
    console.log("score: " + category);
  }
}
