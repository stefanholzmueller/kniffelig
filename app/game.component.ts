import {Component} from 'angular2/core';
import {OnInit} from 'angular2/core';
import {ScoreFieldDirective} from './score-field.directive';
import {ViewModel, Category} from './viewmodel';

@Component({
  directives: [ScoreFieldDirective],
  selector: 'game',
  templateUrl: 'app/game.component.html'
})
export class GameComponent implements OnInit {
  public vm: ViewModel = {
    dice: [1,2,3,4,5],
    categories: [
      { name: 'Aces', value: 123 },
      { name: 'Twos', value: 456 }
    ],
    totalUpper: 0,
    bonus: 0,
    totalLower: 0,
    total: 0
  };
  ngOnInit() {
    // setInterval(()=>this.vm.categories[1].value++,1000);
  }
  findCategory(categoryName) {
    return this.vm.categories.find((elem) => elem.name === categoryName);
  }
}
