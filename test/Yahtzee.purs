module Test.Yahtzee where

import Prelude
import Control.Monad.Eff
import Control.Monad.Eff.Exception
import Test.Assert.Simple
import Yahtzee
import Data.Maybe

tests :: forall e. Eff (err :: EXCEPTION | e) Unit
tests = do
  assertEqual (score Aces [1,2,3,4,5]) (Just 1)
  assertEqual (score Aces [4,1,6,1,1]) (Just 3)
  assertEqual (score Twos [4,2,6,2,1]) (Just 4)
  
  let effScore = scoreStr "Twos" [4,2,6,2,1]
  let errorHandler error = pure Nothing
  let caught = catchException errorHandler effScore
  let pureScore = runPure caught
  assertEqual (pureScore) (Just 4)
