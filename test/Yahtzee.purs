module Test.Yahtzee where

import Prelude
import Control.Monad.Eff
import Control.Monad.Eff.Exception
import Test.Assert.Simple
import Yahtzee

main :: forall e. Eff (err :: EXCEPTION | e) Unit
main = do
  let vm1 = { dice: [1,2,3,4,5] }
  let vm2 = score vm1
  assertEqual vm2.dice [4,4,5,5,6]
