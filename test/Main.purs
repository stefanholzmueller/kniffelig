module Test.Main where

import Prelude (Unit, bind, eq, pure, return, show, (++))
import Control.Monad.Eff (runPure)
--import Control.Monad.Eff.Console (CONSOLE, print)
import Control.Monad.Eff.Exception (catchException)
--import Control.Monad.Eff.Random (RANDOM)
import Data.Array ((..), delete)
import Data.Maybe (Maybe(Just, Nothing))
--import Durstenfeld (shuffle)
import Yahtzee (scoreStr)
import Test.QuickCheck (Result, QC, (<?>), quickCheck)
import Test.QuickCheck.Arbitrary (class Arbitrary)
import Test.QuickCheck.Gen (Gen, chooseInt, elements)


main :: forall eff. QC eff Unit
main = quickCheck (propFullHouse :: Dice -> Result)

data Dice = Dice (Array Int)

instance arbitraryDice :: Arbitrary Dice where
  arbitrary = genFullHouse

genFullHouse :: Gen Dice
genFullHouse = do d1 <- chooseInt 1 6
		  let p = d1 :: Int
	          let all = (1..6) :: Array Int
		  let remaining = (delete p all) :: (Array Int)
                  d2 <- elements 1 remaining
                  return (Dice [d1, d1, d2, d2, d2])

propFullHouse :: Dice -> Result
propFullHouse (Dice dice) = let score = scoreFn dice
			    in score `eq` Just 25 <?> show dice ++ " ---> " ++ show score
  where handler error = pure Nothing
	scoreFn dice  = runPure (catchException handler (scoreStr "FullHouse" dice))
