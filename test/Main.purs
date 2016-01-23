module Test.Main where

import Prelude
import Test.QuickCheck


main :: forall eff. QC eff Unit
main = do
	pips2 <- choose (1, 6)
        pips3 <- choose (1, 6)
	let dice5 = [pips2, pips2, pips3, pips3, pips3]
	quickCheck \n -> n + 1 > n
