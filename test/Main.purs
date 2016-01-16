module Test.Main where

import Prelude
import Control.Monad.Eff
import Control.Monad.Eff.Exception
import Test.Yahtzee

main :: forall e. Eff (err :: EXCEPTION | e) Unit
main = tests
