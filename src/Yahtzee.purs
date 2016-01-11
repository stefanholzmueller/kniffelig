module Yahtzee where

import Prelude

type ViewModel = {
  dice :: Array Int
}

score :: ViewModel -> ViewModel
score vm = vm { dice = [4,4,5,5,6] }
  where
    dice = vm.dice
