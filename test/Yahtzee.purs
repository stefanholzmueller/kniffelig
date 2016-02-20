module Test.Yahtzee where

import Prelude (Unit, bind, pure, return, show, (++), (==))
import Control.Monad.Eff (runPure)
import Control.Monad.Eff.Exception (catchException)
import Data.Array ((..))
import Data.Array.Unsafe (head, tail)
import Data.Maybe (Maybe(Just, Nothing))
import Test.Assert.Simple (assertEqual)
import Test.StrongCheck (class Arbitrary, QC, Result, (<?>), smallCheck)
import Test.StrongCheck.Gen (nChooseK, shuffleArray)
import Yahtzee (Category(Aces, Twos, ThreeOfAKind, FullHouse), score, scoreStr)


tests :: QC Unit
tests = do
  assertEqual (score Aces [1,2,3,4,5]) (Just 1)
  assertEqual (score Aces [4,1,6,1,1]) (Just 3)
  assertEqual (score Twos [4,2,6,2,1]) (Just 4)
  
  let effScore = scoreStr "Twos" [4,2,6,2,1]
  let errorHandler error = pure Nothing
  let caught = catchException errorHandler effScore
  let pureScore = runPure caught
  assertEqual (pureScore) (Just 4)

  assertEqual (score ThreeOfAKind [4,2,6,2,1]) Nothing
  assertEqual (score ThreeOfAKind [2,2,6,2,1]) (Just 13)

  assertEqual (score FullHouse [2,2,6,2,1]) Nothing
  assertEqual (score FullHouse [2,2,6,2,6]) (Just 25)
  smallCheck (propFullHouse :: Dice -> Result)

data Dice = Dice (Array Int)

instance arbitraryDice :: Arbitrary Dice where
  arbitrary = do pair <- nChooseK 2 (1..6)
		 let p = pair :: Array Int
                 let d1 = head p
                 let d2 = head (tail p)
                 let dice = [d1, d1, d2, d2, d2]
                 shuffled <- shuffleArray dice
                 return (Dice shuffled)

propFullHouse :: Dice -> Result
propFullHouse (Dice dice) = let score = scoreFn dice
			    in score == Just 25 <?> show dice ++ " made the test fail with output: " ++ show score
  where handler error = pure Nothing
	scoreFn dice  = runPure (catchException handler (scoreStr "FullHouse" dice))
